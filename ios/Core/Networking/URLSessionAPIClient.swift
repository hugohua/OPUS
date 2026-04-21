import Foundation

final class URLSessionAPIClient: APIClient {
    private let session: URLSession
    private let requestBuilder: RequestBuilder
    private let tokenStore: AuthTokenStore
    private let logger: NetworkLogger
    private let decoder: JSONDecoder

    init(
        session: URLSession = .shared,
        requestBuilder: RequestBuilder,
        tokenStore: AuthTokenStore,
        logger: NetworkLogger,
        decoder: JSONDecoder = JSONDecoder()
    ) {
        self.session = session
        self.requestBuilder = requestBuilder
        self.tokenStore = tokenStore
        self.logger = logger
        self.decoder = decoder
    }

    func send<T: Decodable>(_ endpoint: Endpoint, as type: T.Type) async throws -> T {
        let token = try tokenStore.fetchToken()
        let request = try requestBuilder.makeRequest(for: endpoint, token: token)
        logger.log(request: request)

        do {
            let (data, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw NetworkError.invalidResponse
            }

            logger.log(response: httpResponse, data: data)

            guard (200..<300).contains(httpResponse.statusCode) else {
                throw NetworkError.httpStatus(httpResponse.statusCode, data)
            }

            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw NetworkError.decoding(error.localizedDescription)
            }
        } catch let error as NetworkError {
            logger.log(error: error)
            throw error
        } catch {
            let wrappedError = NetworkError.transport(error.localizedDescription)
            logger.log(error: wrappedError)
            throw wrappedError
        }
    }
}
