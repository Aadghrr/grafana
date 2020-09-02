import {
  DataSourceApi,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataQuery,
  DataSourceJsonData,
  ScopedVars,
  AnnotationQueryRequest,
  AnnotationEvent,
} from '@grafana/data';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { config } from '..';
import { getBackendSrv } from '../services';
import { toDataQueryResponse } from './queryResponse';
import { getAnnotationsFromFrame } from './annotationsFromDataFrame';

const ExpressionDatasourceID = '__expr__';

/**
 * Describes the current health status of a data source plugin.
 *
 * @public
 */
export enum HealthStatus {
  Unknown = 'UNKNOWN',
  OK = 'OK',
  Error = 'ERROR',
}

/**
 * Describes the payload returned when checking the health of a data source
 * plugin.
 *
 * @public
 */
export interface HealthCheckResult {
  status: HealthStatus;
  message: string;
  details?: Record<string, any>;
}

/**
 * Extend this class to implement a data source plugin that is depending on the Grafana
 * backend API.
 *
 * @public
 */
export class DataSourceWithBackend<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
  TAnno = TQuery
> extends DataSourceApi<TQuery, TOptions, TAnno> {
  constructor(instanceSettings: DataSourceInstanceSettings<TOptions>) {
    super(instanceSettings);
  }

  /**
   * Ideally final -- any other implementation may not work as expected
   */
  query(request: DataQueryRequest<TQuery>): Observable<DataQueryResponse> {
    const { intervalMs, maxDataPoints, range, requestId } = request;
    const orgId = config.bootData.user.orgId;
    let targets = request.targets;
    if (this.filterQuery) {
      targets = targets.filter(q => this.filterQuery!(q));
    }
    const queries = targets.map(q => {
      let datasourceId = this.id;
      if (q.datasource === ExpressionDatasourceID) {
        return {
          ...q,
          datasourceId,
          orgId,
        };
      }
      if (q.datasource) {
        const dsName = q.datasource === 'default' ? config.defaultDatasource : q.datasource;
        const ds = config.datasources[dsName];
        if (!ds) {
          throw new Error('Unknown Datasource: ' + q.datasource);
        }
        datasourceId = ds.id;
      }
      return {
        ...this.applyTemplateVariables(q, request.scopedVars),
        datasourceId,
        intervalMs,
        maxDataPoints,
        orgId,
      };
    });

    // Return early if no queries exist
    if (!queries.length) {
      return of({ data: [] });
    }

    const body: any = {
      queries,
    };
    if (range) {
      body.range = range;
      body.from = range.from.valueOf().toString();
      body.to = range.to.valueOf().toString();
    }

    return getBackendSrv()
      .fetch({
        url: '/api/ds/query',
        method: 'POST',
        data: body,
        requestId,
      })
      .pipe(
        map((rsp: any) => {
          return toDataQueryResponse(rsp);
        }),
        catchError(err => {
          return of(toDataQueryResponse(err));
        })
      );
  }

  /**
   * Override to skip executing a query
   *
   * @virtual
   */
  filterQuery?(query: TQuery): boolean;

  /**
   * Override to apply template variables.  The result is usually also `TQuery`, but sometimes this can
   * be used to modify the query structure before sending to the backend.
   *
   * NOTE: if you do modify the structure or use template variables, alerting queries may not work
   * as expected
   *
   * @virtual
   */
  applyTemplateVariables(query: TQuery, scopedVars: ScopedVars): Record<string, any> {
    return query;
  }

  /**
   * Given query configuration, find the standard query model
   *
   * @virtual
   */
  prepareAnnotationQuery?(
    options: AnnotationQueryRequest<TAnno>
  ): { query: TQuery; processor?: (rsp: DataQueryResponse) => AnnotationEvent[] };

  /**
   * This is a standard way to implement annotations in 7.2+, note that this path should eventually be
   * replaced with an observable solution
   */
  async annotationQuery(options: AnnotationQueryRequest<TAnno>): Promise<AnnotationEvent[]> {
    if (!this.prepareAnnotationQuery || !!!options.annotation.enable) {
      return Promise.resolve([]); // not definedprepareAnnotationQuery
    }

    const { query, processor } = this.prepareAnnotationQuery(options);
    if (!query) {
      return Promise.resolve([]); // nothing
    }

    const { annotation, ...rest } = options;
    const startTime = Date.now();
    return this.query({
      ...rest,
      requestId: `anno-${startTime}`,
      startTime,
      scopedVars: {},
      timezone: options.dashboard.timezone,
      targets: [query],
    })
      .toPromise()
      .then(rsp => {
        if (rsp.data?.length) {
          if (processor) {
            return processor(rsp);
          }
          return getAnnotationsFromFrame(rsp.data[0]).events;
        }
        return [];
      });
  }

  /**
   * Make a GET request to the datasource resource path
   */
  async getResource(path: string, params?: any): Promise<any> {
    return getBackendSrv().get(`/api/datasources/${this.id}/resources/${path}`, params);
  }

  /**
   * Send a POST request to the datasource resource path
   */
  async postResource(path: string, body?: any): Promise<any> {
    return getBackendSrv().post(`/api/datasources/${this.id}/resources/${path}`, { ...body });
  }

  /**
   * Run the datasource healthcheck
   */
  async callHealthCheck(): Promise<HealthCheckResult> {
    return getBackendSrv()
      .request({ method: 'GET', url: `/api/datasources/${this.id}/health`, showErrorAlert: false })
      .then(v => {
        return v as HealthCheckResult;
      })
      .catch(err => {
        return err.data as HealthCheckResult;
      });
  }

  /**
   * Checks the plugin health
   */
  async testDatasource(): Promise<any> {
    return this.callHealthCheck().then(res => {
      if (res.status === HealthStatus.OK) {
        return {
          status: 'success',
          message: res.message,
        };
      }
      return {
        status: 'fail',
        message: res.message,
      };
    });
  }
}
